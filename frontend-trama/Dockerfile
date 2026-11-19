FROM node:24.21.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
# Vite incrusta VITE_* al compilar: la URL de teselas debe llegar como build arg.
ARG VITE_MAP_TILES_URL
ENV VITE_MAP_TILES_URL=$VITE_MAP_TILES_URL
RUN npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]