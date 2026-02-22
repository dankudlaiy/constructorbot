const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './script_admin.js',
  output: {
    filename: 'js/admin.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        // Ignore CSS imports — CSS is loaded directly via <link> in HTML
        test: /\.css$/,
        use: 'null-loader',
      },
    ],
  },
  resolve: {
    alias: {
      '../css': path.resolve(__dirname, 'css'),
    },
  },
  devtool: 'source-map',
};
