FROM nginx:alpine

# Template is processed by nginx entrypoint: BACKEND_URL env var is substituted
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

WORKDIR /usr/share/nginx/html

COPY index.html ./
COPY about-us.html ./
COPY admin.html ./
COPY client.html ./
COPY employee.html ./
COPY equipment-scan.html ./
COPY equipment-scan-old-duplicate.html ./
COPY projects-portfolio.html ./
COPY design-preview.html ./
COPY responsive-demo.html ./
COPY js ./js
COPY css ./css
COPY Images ./Images

CMD ["nginx", "-g", "daemon off;"]
