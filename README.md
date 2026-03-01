# Comandos Teste
cd ~/LabSoft/Clinix/Frontend

npx update-browserslist-db@latest

# Comando Docker:
docker buildx build -t clinix-app .

docker build -t clinix-app . (Usa esse)

# Rodar o container como e sem Development:
docker run -d -p 8080:8080 --name clinix-container clinix-app

docker run -d -p 8080:8080 -e ASPNETCORE_ENVIRONMENT=Development --name clinix-container clinix-app (Usa esse por equanto que não sobre pra Produção)

# Acesso:
http://localhost:8080

http://localhost:8080/swagger/ (API)

# Caso precise deletar tudo para testar um buid do zero:
## Para o container e remove
docker stop clinix-container && docker rm clinix-container

## Remove a imagem anterior
docker rmi clinix-app

## (Opcional) Limpa o cache de build do Docker
docker builder prune -f