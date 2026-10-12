# Source database reference

This folder contains sanitized copies of the repository SQL definitions and historical migrations, not a live database dump or a reconciled installer. Account insertions and data-only seed/maintenance bodies are omitted. Some source files are empty. Do not execute scripts in filename order: migration prefixes overlap, schemas drift, and fix_rides_table.sql rebuilds a table. Refer to the complete documentation for entity mappings and installation caveats. No database was read or changed during generation.
