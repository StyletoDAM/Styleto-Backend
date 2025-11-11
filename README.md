# Labasni Backend API
**v1.0.0** – *Core Authentication & Email Verification*

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-v11.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-007EC6?logo=opensourceinitiative&logoColor=white)](./LICENSE)

> **Backend REST API** pour l'application mobile **Labasni** – Recommandations de style basées sur l'IA.  
> Développé avec **NestJS**, **MongoDB**, **JWT**, et validation stricte.

---

## 🚀 Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Inscription sécurisée** | Validation complète : nom complet (2 mots), email, mot de passe fort, téléphone |
| **Vérification email** | Code PIN envoyé par email (6 chiffres, expiration 10 min) |
| **Connexion JWT** | Token sécurisé avec expiration |
| **Mot de passe fort** | 6+ caractères, 1 majuscule, 1 caractère spécial |
| **Hachage bcrypt** | Sécurité des mots de passe |
| **Réinitialisation mot de passe** | OTP SMS via Twilio + token temporaire |
| **Validation backend** | `class-validator` + messages d’erreur claires |
| **Gestion images** | Upload sur **Cloudinary** pour avatar utilisateur |

---

## 🛠 Stack Technique

| Technologie | Version / Rôle |
|-----------|----------------|
| **Langage** | TypeScript |
| **Framework** | NestJS (v11.x) |
| **Base de données** | MongoDB + Mongoose |
| **Authentification** | JWT + Passport |
| **Email** | `@nestjs-modules/mailer` (SMTP Gmail) |
| **SMS / OTP** | Twilio |
| **Upload fichiers** | Cloudinary + Multer |
| **Validation** | `class-validator` + `class-transformer` |
| **Hachage** | `bcryptjs` |
| **Testing** | Jest |
| **Logging** | NestJS Logger |

---

## 📦 Packages Principaux

### NestJS Core
```bash
@nestjs/common @nestjs/core @nestjs/mongoose @nestjs/config @nestjs/platform-express
