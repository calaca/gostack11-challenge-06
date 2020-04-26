import { Router } from 'express';
import { getCustomRepository } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';

import CreateTransactionService from '../services/CreateTransactionService';
import DeleteTransactionService from '../services/DeleteTransactionService';
// import ImportTransactionsService from '../services/ImportTransactionsService';

const transactionsRouter = Router();

transactionsRouter.get('/', async (request, response) => {
  try {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const transactions = await transactionsRepository.find({
      select: ['id', 'title', 'value', 'type', 'created_at', 'updated_at'],
      relations: ['category'],
    });

    const balance = await transactionsRepository.getBalance();

    return response.status(200).json({ transactions, balance });
  } catch (err) {
    return response
      .status(err.statusCode)
      .json({ message: err.message, status: 'error' });
  }
});

transactionsRouter.post('/', async (request, response) => {
  try {
    const { title, value, type, category } = request.body;

    const createTransaction = new CreateTransactionService();

    const transaction = await createTransaction.execute({
      title,
      value,
      type,
      category,
    });

    return response.status(200).json(transaction);
  } catch (err) {
    return response
      .status(err.statusCode)
      .json({ message: err.message, status: 'error' });
  }
});

transactionsRouter.delete('/:id', async (request, response) => {
  try {
    const { id } = request.params;

    const deleteTransaction = new DeleteTransactionService();

    await deleteTransaction.execute(id);

    return response.sendStatus(200);
  } catch (err) {
    return response
      .status(err.statusCode)
      .json({ message: err.message, status: 'error' });
  }
});

transactionsRouter.post('/import', async (request, response) => {
  try {
    return response.send();
  } catch (err) {
    return response
      .status(err.statusCode)
      .json({ message: err.message, status: 'error' });
  }
});

export default transactionsRouter;
