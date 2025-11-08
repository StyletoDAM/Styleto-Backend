
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validates a strong password:
 * - At least 6 characters
 * - At least one uppercase letter
 * - At least one special character
 */
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: any): boolean {
    if (typeof password !== 'string') return false;

    const hasMinLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/]/.test(password);

    return hasMinLength && hasUppercase && hasSpecialChar;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Password must be at least 6 characters long and contain at least one uppercase letter and one special character.';
  }
}

/**
 * Custom decorator with proper ValidationOptions support
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions, // LE MESSAGE EST ICI
      validator: IsStrongPasswordConstraint,
    });
  };
}