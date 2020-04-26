import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';

import { getCustomRepository, getRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filenameCSV: string;
}

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private async loadCSV(filePath: string): Promise<TransactionCSV[]> {
    const readCSVStream = fs.createReadStream(filePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const transactionsCSV: TransactionCSV[] = [];

    // format line into object
    parseCSV.on('data', line => {
      const [title, type, value, category] = line;

      if (!(title || type || value || category)) {
        throw new AppError('Missing field in CSV');
      }

      transactionsCSV.push({ title, type, value, category });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    return transactionsCSV;
  }

  async execute({ filenameCSV }: Request): Promise<Transaction[]> {
    const filePathCSV = path.resolve(__dirname, '..', '..', 'tmp', filenameCSV);
    const transactionsCSV = await this.loadCSV(filePathCSV);

    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    // 1. Gets a set of unique categories from the CSV file
    const uniqueCategories = Array.from(
      new Set(transactionsCSV.map(transaction => transaction.category)),
    );

    // 2. Checks balance and throws an error if import will make balance go negative
    const importTotal = transactionsCSV.reduce(
      (acc, cur) => (cur.type === 'income' ? acc + cur.value : acc - cur.value),
      0,
    );

    const { total } = await transactionsRepository.getBalance();

    if (total + importTotal < 0) {
      throw new AppError('Cannot make outcomes greater than your balance');
    }

    // 3. Creates and run an array of promises made of categories
    const categories = uniqueCategories.map(async categoryTitle => {
      // checks if category already exists
      let currentCategory = await categoriesRepository.findOne({
        where: {
          title: categoryTitle,
        },
      });

      // creates new category
      if (!currentCategory) {
        currentCategory = categoriesRepository.create({
          title: categoryTitle,
        });
        await categoriesRepository.save(currentCategory);
      }

      return currentCategory;
    });

    // creates missing categories
    await Promise.all(categories);

    // 4. Creates and return an array of promises made of transactions
    const transactions = transactionsCSV.map(
      async ({ title, value, type, category }) => {
        // gets current category
        const currentCategory = await categoriesRepository.findOne({
          where: {
            title: category,
          },
        });

        // creates new transaction
        const transaction = transactionsRepository.create({
          title,
          value,
          type,
          category_id: currentCategory?.id,
        });

        await transactionsRepository.save(transaction);

        return transaction;
      },
    );

    return Promise.all(transactions);
  }
}

export default ImportTransactionsService;
