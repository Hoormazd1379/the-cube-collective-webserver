const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const IgnoreEmitPlugin = require('ignore-emit-webpack-plugin');

module.exports = {
  entry: {
    // 'script': './dev/script.js',
    'style': './dev/style.scss',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.(css)$/,
        use: [MiniCssExtractPlugin.loader,'css-loader']
      },
      {
        test: /\.(s(a|c)ss)$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
            },
          },
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|svg|jpg|png)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    new IgnoreEmitPlugin(['style.js'])
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public'),
  }
};