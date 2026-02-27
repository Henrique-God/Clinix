




cd ~/LabSoft/Clinix/Frontend
npx update-browserslist-db@latest
cd ..

# Comando Docker:
docker buildx build -t clinix-app .

docker build -t clinix-app .

# Rodar o container:
docker run -d -p 8080:8080 --name clinix-container clinix-app

# Acesso:
http://localhost:8080

# Caso precise deletar tudo para testar um buid do zero:
#Para o container e remove
docker stop clinix-container && docker rm clinix-container

#Remove a imagem anterior
docker rmi clinix-app

#(Opcional) Limpa o cache de build do Docker
docker builder prune -f