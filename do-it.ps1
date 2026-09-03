$pgHba = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$pgHbaBak = "$pgHba.bak"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# 1. Backup
Copy-Item -Path $pgHba -Destination $pgHbaBak -Force

# 2. Modify to trust (prepend trust rules so they hit first)
$trustRules = @"
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
"@
$originalContent = Get-Content -Path $pgHba -Raw
Set-Content -Path $pgHba -Value ($trustRules + "`r`n" + $originalContent)

# 3. Restart service
Restart-Service -Name postgresql-x64-18 -Force

# 4. Run SQL commands
& $psql -U postgres -c "CREATE USER camtech WITH PASSWORD 'camtech123';"
& $psql -U postgres -c "ALTER USER camtech WITH PASSWORD 'camtech123';"
& $psql -U postgres -c "CREATE DATABASE `"camtechStore`" OWNER camtech;"
& $psql -U postgres -d "camtechStore" -c "GRANT ALL PRIVILEGES ON DATABASE `"camtechStore`" TO camtech;"

# 5. Restore backup
Copy-Item -Path $pgHbaBak -Destination $pgHba -Force
Remove-Item -Path $pgHbaBak -Force

# 6. Restart service again
Restart-Service -Name postgresql-x64-18 -Force

Write-Output "Done!"
