Need to do the following.

1.Load backup DB from prod
2.Run apply_department_migration_script.sh
3.Do make fresh-db
4.Run restore_tables_correct_order.sh, using #1
5.Run uuid_migration.sql
6.Run apply_bcnf_migration.sql
