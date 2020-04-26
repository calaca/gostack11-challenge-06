import { getCustomRepository, getRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    let category_id;

    // check balance if transaction type is outcome
    if (type === 'outcome') {
      const balance = await transactionsRepository.getBalance();

      if (value > balance.total) {
        throw new AppError('Cannot make outcomes greater than your balance');
      }
    }

    // check if category exists
    const categoryExists = await categoriesRepository.findOne({
      where: { title: category },
    });

    if (categoryExists) {
      category_id = categoryExists.id;
    } else {
      const newCategory = categoriesRepository.create({
        title: category,
      });

      const savedCategory = await categoriesRepository.save(newCategory);

      category_id = savedCategory.id;
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
