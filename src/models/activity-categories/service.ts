import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, IsNull, Repository } from "typeorm"

import { ActivityCategoryMeasurementTypesService } from "#models/activity-category-measurement-types/service"
import { BoardsService } from "#models/boards/service"
import { UserEntity } from "#models/user/entities/user.entity"

import { CreateActivityCategoryDto } from "./dto/create-activity-category.dto"
import { SearchActivityCategoriesQueryDto } from "./dto/seach-activity-categories-query.dto"
import { UpdateActivityCategoryDto } from "./dto/update-activity-category.dto"
import { ActivityCategoryEntity } from "./entities/activity-category.entity"

@Injectable()
export class ActivityCategoriesService {
  constructor(
    @InjectRepository(ActivityCategoryEntity)
    private activityCategoriesRepository: Repository<ActivityCategoryEntity>,
    private activityCategoryMeasurementTypesService: ActivityCategoryMeasurementTypesService,
    private boardsService: BoardsService
  ) {}

  async search({
    authorizedUser,
    query,
  }: {
    authorizedUser: UserEntity
    query: SearchActivityCategoriesQueryDto
  }): Promise<ActivityCategoryEntity[]> {
    const accessibleBoardsIds = [
      ...new Set([
        ...authorizedUser.administratedBoards.map((board) => board.id),
        ...authorizedUser.boards.map((board) => board.id),
      ]),
    ]
    const boardsIdsToSearchWith =
      query.boardId === undefined
        ? accessibleBoardsIds
        : query.boardId
            .split(",")
            .map((boardId) => parseInt(boardId))
            .filter((boardIdFromQuery) => accessibleBoardsIds.includes(boardIdFromQuery))

    return this.activityCategoriesRepository.find({
      order: { id: "ASC", name: "ASC" },
      relations: { board: true, measurementType: true, owner: true },
      where: {
        ...(query.id !== undefined && { id: In(query.id.split(",")) }),
        ...(query.ownerId !== undefined && { owner: In(query.ownerId.split(",")) }),
        board: { id: In(boardsIdsToSearchWith) },
      },
    })
  }

  async find({
    authorizedUser,
    categoryId,
  }: {
    authorizedUser: UserEntity
    categoryId: ActivityCategoryEntity["id"]
  }): Promise<ActivityCategoryEntity> {
    const category = await this.activityCategoriesRepository.findOne({
      relations: { board: true, measurementType: true, owner: true },
      where: { id: categoryId },
    })
    if (category === null) throw new NotFoundException({})

    const isAuthorizedUserBoardAdmin = authorizedUser.administratedBoards.some((board) => {
      return board.id === category.board.id
    })
    const isAuthorizedUserBoardMember = authorizedUser.boards.some((board) => board.id === category.board.id)
    const canAuthorizedUserFetchThisCategory = isAuthorizedUserBoardAdmin || isAuthorizedUserBoardMember
    if (!canAuthorizedUserFetchThisCategory) {
      throw new ForbiddenException({ message: "Access denied." })
    }

    return category
  }

  async create({
    authorizedUser,
    createActivityCategoryDto,
  }: {
    authorizedUser: UserEntity
    createActivityCategoryDto: CreateActivityCategoryDto
  }): Promise<ActivityCategoryEntity> {
    if (createActivityCategoryDto.name === undefined || createActivityCategoryDto.name === "") {
      throw new BadRequestException({ fields: { name: "Required field." } })
    }
    if (createActivityCategoryDto.measurementTypeId === undefined) {
      throw new BadRequestException({ fields: { measurementTypeId: "Required field." } })
    }
    if (createActivityCategoryDto.boardId === undefined) {
      throw new BadRequestException({ fields: { boardId: "Required field." } })
    }
    if (createActivityCategoryDto.unit === undefined) {
      throw new BadRequestException({ fields: { unit: "Required field." } })
    }
    if (createActivityCategoryDto.measurementTypeId === 1) {
      if (typeof createActivityCategoryDto.unit !== "string" || createActivityCategoryDto.unit === "") {
        throw new BadRequestException({
          fields: {
            measurementTypeId: "«Quantitative» activity must be measured in units.",
            unit: "Required for «Quantitative» activities.",
          },
        })
      }
    }
    if (createActivityCategoryDto.measurementTypeId === 2 && createActivityCategoryDto.unit !== null) {
      throw new BadRequestException({
        fields: {
          measurementTypeId: "«Yes / no» activity cannot be measured with any unit.",
          unit: "«Yes / no» activity cannot be measured with any unit.",
        },
      })
    }
    const measurementType = await this.activityCategoryMeasurementTypesService
      .find({ activityCategoryMeasurementTypeId: createActivityCategoryDto.measurementTypeId })
      .catch(() => {
        throw new BadRequestException({ fields: { measurementTypeId: "Invalid value." } })
      })
    const board = await this.boardsService.find({ boardId: createActivityCategoryDto.boardId }).catch(() => {
      throw new BadRequestException({ fields: { boardId: "Invalid value." } })
    })
    const similarExistingCategory = await this.activityCategoriesRepository.findOne({
      relations: { board: true, measurementType: true, owner: true },
      where: {
        board,
        measurementType,
        name: createActivityCategoryDto.name,
        owner: authorizedUser,
        unit: createActivityCategoryDto.unit === null ? IsNull() : createActivityCategoryDto.unit,
      },
    })
    if (similarExistingCategory !== null) {
      throw new BadRequestException({
        fields: {
          boardId: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          measurementType: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          name: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          unit: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
        },
      })
    }
    const category = this.activityCategoriesRepository.create({
      board,
      measurementType,
      name: createActivityCategoryDto.name,
      owner: authorizedUser,
      unit: createActivityCategoryDto.unit,
    })
    const createdCategory = await this.activityCategoriesRepository.save(category)
    return await this.find({ authorizedUser, categoryId: createdCategory.id })
  }

  async update({
    authorizedUser,
    categoryId,
    updateActivityCategoryDto,
  }: {
    authorizedUser: UserEntity
    categoryId: ActivityCategoryEntity["id"]
    updateActivityCategoryDto: UpdateActivityCategoryDto
  }): Promise<ActivityCategoryEntity> {
    const category = await this.find({ authorizedUser, categoryId })

    const isAuthorizedUserBoardAdmin = authorizedUser.administratedBoards.some((board) => {
      return board.id === category.board.id
    })
    const isAuthorizedUserBoardMember = authorizedUser.boards.some((board) => board.id === category.board.id)
    const doesAuthorizedUserOwnThisCategory = category.owner.id === authorizedUser.id
    const canAuthorizedUserEditThisCategory =
      isAuthorizedUserBoardAdmin || (isAuthorizedUserBoardMember && doesAuthorizedUserOwnThisCategory)
    if (!canAuthorizedUserEditThisCategory) {
      throw new ForbiddenException({ message: "Access denied." })
    }

    if (
      updateActivityCategoryDto.boardId === undefined &&
      updateActivityCategoryDto.measurementTypeId === undefined &&
      updateActivityCategoryDto.name === undefined &&
      updateActivityCategoryDto.unit === undefined
    ) {
      return category
    }
    if (updateActivityCategoryDto.measurementTypeId !== undefined) {
      try {
        category.measurementType = await this.activityCategoryMeasurementTypesService.find({
          activityCategoryMeasurementTypeId: updateActivityCategoryDto.measurementTypeId,
        })
      } catch {
        throw new BadRequestException({ fields: { measurementTypeId: "Invalid value." } })
      }
    }
    if (updateActivityCategoryDto.boardId !== undefined) {
      try {
        category.board = await this.boardsService.find({ boardId: updateActivityCategoryDto.boardId })
      } catch {
        throw new BadRequestException({ fields: { boardId: "Invalid board." } })
      }
    }
    if (updateActivityCategoryDto.name !== undefined) {
      if (updateActivityCategoryDto.name === "") {
        throw new BadRequestException({ fields: { name: "Cannot be empty." } })
      }
      category.name = updateActivityCategoryDto.name
    }
    if (updateActivityCategoryDto.unit !== undefined) {
      category.unit = updateActivityCategoryDto.unit
    }
    if (category.measurementType.id === 1) {
      if (typeof category.unit !== "string" || category.unit === "") {
        throw new BadRequestException({
          fields: {
            measurementTypeId: "«Quantitative» activity must be measured in units.",
            unit: "Required for «Quantitative» activities.",
          },
        })
      }
    }
    if (category.measurementType.id === 2 && category.unit !== null) {
      throw new BadRequestException({
        fields: {
          measurementTypeId: "«Yes / no» activity cannot be measured with any unit.",
          unit: "«Yes / no» activity cannot be measured with any unit.",
        },
      })
    }
    const similarExistingCategory = await this.activityCategoriesRepository.findOne({
      relations: { board: true, measurementType: true, owner: true },
      where: {
        board: category.board,
        measurementType: category.measurementType,
        name: category.name,
        owner: category.owner,
        unit: category.unit === null ? IsNull() : category.unit,
      },
    })
    if (similarExistingCategory !== null) {
      throw new BadRequestException({
        fields: {
          boardId: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          measurementType: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          name: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
          unit: `Similar «${similarExistingCategory.name}» category already exists in this board.`,
        },
      })
    }
    await this.activityCategoriesRepository.save(category)
    return await this.find({ authorizedUser, categoryId })
  }

  async delete({
    authorizedUser,
    categoryId,
  }: {
    authorizedUser: UserEntity
    categoryId: ActivityCategoryEntity["id"]
  }): Promise<ActivityCategoryEntity> {
    const category = await this.find({ authorizedUser, categoryId })

    const isAuthorizedUserBoardAdmin = authorizedUser.administratedBoards.some((board) => {
      return board.id === category.board.id
    })
    const isAuthorizedUserBoardMember = authorizedUser.boards.some((board) => board.id === category.board.id)
    const doesAuthorizedUserOwnThisCategory = category.owner.id === authorizedUser.id
    const canAuthorizedUserDeleteThisCategory =
      isAuthorizedUserBoardAdmin || (isAuthorizedUserBoardMember && doesAuthorizedUserOwnThisCategory)
    if (!canAuthorizedUserDeleteThisCategory) {
      throw new ForbiddenException({ message: "Access denied." })
    }

    await this.activityCategoriesRepository.delete(categoryId)
    return category
  }
}