---
name: form-handling-validation
description: Use this skill when performing form handling and validation for web forms, server actions, APIs, and interactive inputs.
---

# Goal
Create forms that collect data accurately, validate clearly, and recover gracefully from errors.

# Instructions
1. Identify fields, requiredness, dependencies, defaults, and server-owned values.
2. Use native form behavior where possible and the repo's form library where established.
3. Validate client-side for responsiveness and server-side for trust.
4. Display field-level errors, form-level errors, loading states, success states, and disabled states.
5. Preserve user input on failed submission.
6. Test keyboard navigation, screen reader labels, invalid submissions, and successful submission.

# Input
Use the form purpose, data schema, validation rules, submission target, framework, and existing form patterns.

# Output
Generate form components, validation schemas, submission handlers, error mapping, and tests.

# Best Practices
- Connect labels, descriptions, and errors to controls.
- Avoid disabling submit unless errors are also visible and understandable.
- Use appropriate input types, autocomplete, and inputmode.
- Keep sensitive fields secure and avoid logging submitted secrets.
- Make async validation cancellable or race-safe where relevant.
