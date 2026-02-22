FROM php:8.2-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    postgresql-dev \
    ffmpeg \
    curl \
    git \
    unzip \
    fontconfig \
    ttf-freefont \
    libzip-dev

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql zip

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install Inter font (required for canvas text rendering & FFmpeg drawtext)
RUN mkdir -p /usr/share/fonts/truetype/inter && \
    cd /tmp && \
    wget -q "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -O inter.zip && \
    unzip -q inter.zip -d inter && \
    find inter/ -name "*BlackItalic*" -name "*.ttf" | head -1 | xargs -I{} cp {} /usr/share/fonts/truetype/inter/Inter-BlackItalic.ttf && \
    fc-cache -f && \
    rm -rf /tmp/inter /tmp/inter.zip

# Nginx configuration
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Supervisor configuration (runs nginx + php-fpm + worker)
COPY docker/supervisord.conf /etc/supervisord.conf

# Set working directory
WORKDIR /var/www/html

# Install PHP dependencies in /var/www/ (parent of html)
# because existing files use require __DIR__ . '/../vendor/autoload.php'
COPY composer.json composer.lock* /var/www/
RUN cd /var/www && (composer install --no-dev --optimize-autoloader 2>/dev/null || \
    (composer init --name="banner/generator" --require="vlucas/phpdotenv:^5.5" --no-interaction && \
     composer install --no-dev --optimize-autoloader))

# Create necessary directories
RUN mkdir -p /var/www/html/uploads/videos \
             /var/www/html/uploads/images \
             /var/www/html/outputs \
             /var/www/html/miniapp/dist/js \
             /var/www/html/miniapp/dist/css && \
    chown -R www-data:www-data /var/www/html/uploads /var/www/html/outputs

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
