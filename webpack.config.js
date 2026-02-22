const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    app: './script.js',
    zip_override: './zip_override.js',
  },
  output: {
    filename: 'js/[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/app.bundle.css',
    }),
  ],
  resolve: {
    alias: {
      '../css': path.resolve(__dirname, 'css'),
    },
  },
  devtool: 'source-map',
};
