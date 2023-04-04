const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: "production",
  target: "web",
  entry: {
    main: path.resolve(__dirname, 'index.tsx'),
  },
  output: {
    clean: true, // Clean the output directory before emit.
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "build"),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        pathRewrite: { '^/api': '' },
      },
    },
    port: 3000,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'AutoMv',
      template: path.resolve(__dirname, './src/index.html'), // template file
      filename: 'index.html', // output file
    }),
  ],
  module: {

    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.ts|.tsx?$/,
        exclude: /node_modules/,
        use: ['ts-loader']
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    
    fallback: { 
      "querystring": require.resolve("querystring-es3"),
      "buffer": require.resolve("buffer/"),
      "timers": require.resolve("timers-browserify"),
      "stream": require.resolve("stream-browserify"),
      "vm": require.resolve('vm-browserify'), 
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "url": require.resolve("url/")
    }
  }
};

