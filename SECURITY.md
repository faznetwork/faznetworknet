# FAZ NETWORK Security Policy

## Reporting a vulnerability
Do not open a public issue for a suspected vulnerability or include customer data, passwords, access tokens, router credentials, database URLs, or production logs. Report it privately to the repository owner through GitHub's private vulnerability reporting feature, if enabled, or contact the owner through a private channel.

## Required handling of secrets
- Store deployment credentials only in the hosting provider's environment/secrets store or GitHub Actions secrets.
- Never commit `.env` files, PostgreSQL dumps, customer exports, RouterOS credentials, payment credentials, session secrets, private keys, or production logs.
- If a credential has ever been committed to a public repository, treat it as compromised and rotate/revoke it. Deleting the file in a later commit does not remove it from Git history or forks.
- Use separate least-privilege credentials for development, testing, and production.

## Production safety
- Do not run schema migrations or destructive SQL against production without a verified, restorable backup and a reviewed migration.
- Prefer a branch and pull request for code changes. Require tests and review before merging to the production branch.
- Never expose PostgreSQL directly to the public Internet. Use a private network or authenticated tunnel.
- Keep customer records in the database, not in GitHub or CI artifacts.

## Repository-owner checklist
- Set repository visibility to **Private**.
- Enable two-factor authentication for the GitHub account and review active sessions, personal access tokens, SSH keys, and authorized OAuth/GitHub Apps.
- Rotate any database password or secret previously committed to this repository; update the hosting environment separately and verify connectivity.
- Configure branch protection/rules for `main`: pull request required, required CI checks, block force pushes and deletion, and restrict bypass where possible.
- Enable secret scanning/push protection and Dependabot security updates where available.
- Review forks, collaborators, deploy keys, Actions permissions, and webhooks.
- Use least-privilege, short-lived deployment credentials and pin third-party Actions to trusted versions/SHAs.

## Limitations
Private visibility limits who can browse the source but cannot prevent an authorized collaborator from copying it. No repository setting guarantees that software can never be copied or hacked. Security depends on access controls, secret hygiene, code review, dependency updates, runtime hardening, and backups.
