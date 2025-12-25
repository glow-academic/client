Beta Branch Backup - Removed Commits

This folder contains a backup of commits that were removed from the beta branch.

Date: December 25, 2025
Original beta HEAD: 00c6faf4f
Target commit: 57e88dea62f98c98c5c0a248c033c16d88812538
Backup branch: beta-backup-20251225-123500

Files:
- beta-removed-commits-*.bundle: Git bundle containing all removed commits

Recovery Instructions:
1. To restore from bundle:
   git fetch <bundle-file> beta-backup:beta-restored
   git checkout beta-restored

2. To restore from backup branch:
   git checkout beta-backup-20251225-123500

3. To view commits in bundle:
   git log <bundle-file> beta

Removed Commits (26 total):
- 00c6faf4f more fixes
- 20e1fcb00 more parsing
- cc7ead21c more parsing
- bf6ae8dda new dash
- ba8aea5ba fixes
- 057798648 fixes
- fb5d6ea7a documents fixes
- b28e70573 more fixes
- 18c797eba activity parsing
- e20ee2400 document + actitivy start
- 271345053 fixes
- 8a0f7d0f0 fixes
- 651dd43f9 fixes
- e56f81e9b fixes
- 4c1f4735f fixes
- 05cde77b6 fixes
- 05380e895 personas fixes
- 8dbba8e6b fixes
- f3e6436bf fixes
- fb7ee0d9b more fixes
- 2ee805e51 fixes
- f5ba23f1a fixes
- 2b876b15d more fixes
- 0144ab7f8 more cohort logic
- 31718aac4 more cohort fixes
- 53ecf89ad started cohorts, personas, simulations
