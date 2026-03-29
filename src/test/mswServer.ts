import { setupServer } from 'msw/node';
import { handlers } from './mswHandlers';

export const mswServer = setupServer(...handlers);
