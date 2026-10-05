# Code submission preparation

The source remains in the repository root above the submission directory.
The code folder is intentionally not populated with a duplicate working tree
that could include credentials, generated files or dependency caches.

Before submission, confirm the fork and commit the reviewed source changes.
Use git archive against that reviewed commit to export a source ZIP into this
folder. Check tracked files first: existing tracked logs/build outputs can
remain tracked even when .gitignore lists them. Exclude local credentials,
real account data, node_modules, .report-tools and build/cache outputs. Include
backend, mobile, database scripts and execution/configuration documentation.
Confirm the archive can be extracted and built on a clean machine.

Write the confirmed fork URL in Group-PENDING-Names.txt, add full names/student
numbers and contribution records, and rename folder/file placeholders. No
repository was forked, published or pushed by the documentation preparation.
