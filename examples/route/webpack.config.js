const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = (_, argv) => {
  const __DEV__ = argv.mode === 'development';

  return {
    entry: {
      index: './src',
    },
    devtool: __DEV__ ? 'eval-source-map' : false,
    context: __dirname,
    resolve: {
      extensions: ['.template', '.ts', '.tsx', '.js', '.jsx', '.json'],
      alias: {
        crypto: require.resolve('crypto-browserify'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              target: 'es5',
            },
            transpileOnly: true,
            onlyCompileBundledFiles: true,
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.template$/,
          use: __DEV__
            ? [
                {
                  loader: '@yurijs/hmr-template-loader',
                },
                {
                  loader: '@yurijs/template-loader',
                  options: {
                    defaultNS: require.resolve('./src/components/index.tsx'),
                    styleExtension: '.less',
                    cssModules: true,
                  },
                },
              ]
            : [
                {
                  loader: require.resolve('@yurijs/template-loader'),
                  options: {
                    defaultNS: require.resolve('./src/components/index.tsx'),
                    styleExtension: '.less',
                    cssModules: true,
                  },
                },
              ],
        },
        {
          test: /\.less$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: true,
              },
            },
            'less-loader',
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, './src/index.html'),
      }),
    ],
    devServer: {
      hot: true,
      historyApiFallback: true,
    },
  };
};
