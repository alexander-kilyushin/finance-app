import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"

import { AuthGuard } from "#models/auth/guard"
import { UserEntity } from "#models/user/entities/user.entity"

import { AuthorizedUser } from "#helpers/AuthorizedUser.decorator"

import { CreateBoardDto } from "./dto/create-board.dto"
import { SearchBoardsQueryDto } from "./dto/search-boards-query.dto"
import { UpdateBoardDto } from "./dto/update-board.dto"
import { BoardsService } from "./service"

@Controller("boards")
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(private boardsService: BoardsService) {}

  @Get("search")
  search(
    @Query()
    query: SearchBoardsQueryDto,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.search({ authorizedUser, query })
  }

  @Get(":id")
  find(
    @Param("id")
    boardId: string
  ) {
    return this.boardsService.find({ boardId: parseInt(boardId) })
  }

  @Post()
  create(
    @Body()
    requestBody: CreateBoardDto,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.create({ authorizedUser, requestBody })
  }

  @Post(":boardId/add-member/:candidateForMembershipId")
  addMember(
    @Param("boardId")
    boardId: string,
    @Param("candidateForMembershipId")
    candidateForMembershipId: string,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.addMember({
      authorizedUser,
      boardId: parseInt(boardId),
      candidateForMembershipId: parseInt(candidateForMembershipId),
    })
  }

  @Post(":boardId/remove-member/:candidateForRemovingId")
  leave(
    @Param("boardId")
    boardId: string,
    @Param("candidateForRemovingId")
    candidateForRemovingId: string,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.removeMember({
      authorizedUser,
      boardId: parseInt(boardId),
      candidateForRemovingId: parseInt(candidateForRemovingId),
    })
  }

  @Patch(":id")
  update(
    @Param("id")
    boardId: string,
    @Body()
    requestBody: UpdateBoardDto,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.update({ authorizedUser, boardId: parseInt(boardId), requestBody })
  }

  @Delete(":id")
  delete(
    @Param("id")
    boardId: string,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ) {
    return this.boardsService.delete({ authorizedUser, boardId: parseInt(boardId) })
  }
}
