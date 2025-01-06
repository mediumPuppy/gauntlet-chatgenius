import { Request, Response, NextFunction, RequestHandler } from 'express';

interface ValidationRule {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
}

interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

export const validateRequest = (schema: ValidationSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    const validateObject = (
      obj: any,
      schemaSection: Record<string, ValidationRule> | undefined,
      location: string
    ): void => {
      if (!schemaSection) return;

      for (const [key, rule] of Object.entries(schemaSection)) {
        if (rule.required && !obj[key]) {
          errors.push(`${key} is required in ${location}`);
          continue;
        }

        if (obj[key] && typeof obj[key] !== rule.type) {
          errors.push(`${key} must be of type ${rule.type} in ${location}`);
        }
      }
    };

    validateObject(req.body, schema.body, 'body');
    validateObject(req.query, schema.query, 'query');
    validateObject(req.params, schema.params, 'params');

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    next();
  };
};

// Validation middleware for signup
export const validateSignup = validateRequest({
  body: {
    email: { type: 'string', required: true },
    password: { type: 'string', required: true },
    username: { type: 'string', required: true }
  }
});

// Validation middleware for login
export const validateLogin = validateRequest({
  body: {
    email: { type: 'string', required: true },
    password: { type: 'string', required: true }
  }
}); 