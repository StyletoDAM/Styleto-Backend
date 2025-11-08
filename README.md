# Labasni Backend API  
**v1.0.0** – *Core Authentication & Email Verification*

> Backend REST API pour l'application mobile **Labasni** – Recommandations de style basées sur l'IA.  
> Développé avec **NestJS**, **MongoDB**, **JWT**, et **validation stricte**.

---

## Fonctionnalités (v1.0.0)

| Fonctionnalité | Description |
|----------------|-----------|
| **Inscription sécurisée** | Validation complète : nom complet (2 mots), email, mot de passe fort, téléphone |
| **Vérification email** | Code PIN envoyé par email (6 chiffres, expiration 10 min) |
| **Connexion JWT** | Token sécurisé avec expiration |
| **Mot de passe fort** | 6+ caractères, 1 majuscule, 1 caractère spécial |
| **Hachage bcrypt** | Sécurité des mots de passe |
| **Validation backend** | `class-validator` + messages d’erreur claires |
| **Architecture modulaire** | Modules séparés : `Auth`, `User`, `Mail` |

---

## Stack Technique

```text
Framework       : NestJS (TypeScript)
Database        : MongoDB + Mongoose
Auth            : JWT + bcrypt
Email           : @nestjs-modules/mailer (Gmail SMTP)
Validation      : class-validator + class-transformer
Architecture    : MVC, Modules, DTOs, Guards, Interceptors