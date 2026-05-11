import { HttpStatus } from '@nestjs/common';

export type IResponse<T> = {
  success: boolean;
  statusCode: HttpStatus;
  data: T;
  message?: string;
  errors?: any;
  timestamp?: string;
  path?: string;
};
export type IValidationError = {
  field: string;
  errors: string[];
};
