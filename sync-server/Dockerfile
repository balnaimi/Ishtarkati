# Build
FROM golang:1.24-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ishtarkati-sync ./cmd/server

# Default image is root (not :nonroot) so bind mounts like ./data:/data work on typical Linux hosts
# where the folder is root-owned. The :nonroot variant often cannot write to such mounts → create_failed.
FROM gcr.io/distroless/static-debian12
WORKDIR /
COPY --from=build /out/ishtarkati-sync /ishtarkati-sync
EXPOSE 8080
ENV SYNC_LISTEN_ADDR=:8080
ENV SYNC_DATA_DIR=/data
ENTRYPOINT ["/ishtarkati-sync"]
