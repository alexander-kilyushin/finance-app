import { InputType, Field, Int } from '@nestjs/graphql'

// types
import { IFinanceCategory, IFinanceCategoryType } from '#interfaces/finance'

@InputType()
export class CreateFinanceCategoryInput {
	@Field(() => Int)
	typeId: IFinanceCategoryType['id']

	@Field(() => String)
	name: IFinanceCategory['name']
}