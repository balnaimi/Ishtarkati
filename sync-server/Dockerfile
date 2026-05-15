# Build
FROM golang:1.24-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ishtarkati-sync ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/ishtarkati-sync /ishtarkati-sync
USER nonroot:nonroot
EXPOSE 8080
ENV SYNC_LISTEN_ADDR=:8080
ENV SYNC_DATA_DIR=/data
ENTRYPOINT ["/ishtarkati-sync"]
