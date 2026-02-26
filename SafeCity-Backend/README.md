**For Sana**
password: admin123
"GDAL_LIBRARY_PATH": "C:/Program Files/QGIS 3.34.15/bin/gdal310.dll",
"GEOS_LIBRARY_PATH": "C:/Program Files/QGIS 3.34.15/bin/geos_c.dll"

**For Anoushay**
password: postgres
"GDAL_LIBRARY_PATH": "C:/Program Files/QGIS 3.34.3/bin/gdal308.dll",
"GEOS_LIBRARY_PATH": "C:/Program Files/QGIS 3.34.3/bin/geos_c.dll"

**For Imam**
password: postgres
"GDAL_LIBRARY_PATH": "C:/Program Files/QGIS 3.44.1/bin/gdal311.dll",
"GEOS_LIBRARY_PATH": "C:/Program Files/QGIS 3.44.1/bin/geos_c.dll"

**Make Migration Command**
python manage.py makemigrations --settings=server.settings.local

**Migrate Command**
python manage.py migrate --settings=server.settings.local

**To run backend server Command**
python manage.py runserver --settings=server.settings.local

**To activate Environment for backend**
python -m venv venv
venv\Scripts\Activate **(RUN THIS ONLY TO ACTIVATE ENVIRONMENT)**
pip install -r requirements.txt