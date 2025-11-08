// src/common/validators/is-full-name.validator.ts

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validates that a string contains at least two words separated by one or more spaces.
 * Example: "John Doe" → valid, "John" → invalid, "John  Doe" → valid
 */
@ValidatorConstraint({ name: 'isFullName', async: false })
export class IsFullNameConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;

    const words = value.trim().split(/\s+/);
    return words.length >= 2 && words.every(word => word.length > 0);
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Full name must contain at least two words separated by a space.';
  }
}

/**
 * Decorator to use in DTOs
 */
export function IsFullName(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsFullNameConstraint,
    });
  };
}