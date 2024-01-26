FROM busybox:musl
COPY . .
CMD ["httpd", "-f", "-h", "src"]