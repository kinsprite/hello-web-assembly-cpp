
#!/bin/sh

rm -Rf output
mkdir output

docker run \
  --rm \
  -v $(pwd):$(pwd) \
  -u $(id -u):$(id -g) \
  emscripten/emsdk \
  emcc $(pwd)/src/hello.cpp $(pwd)/src/my_class.cpp \
  --std=c++14  --shell-file shell_minimal.html \
  --emrun -o $(pwd)/output/hello.html -s NO_EXIT_RUNTIME=1 \
  -s EXPORTED_FUNCTIONS="['_main', '_testCall', '_printNumber','_square', '_multiply']" \
  -s EXTRA_EXPORTED_RUNTIME_METHODS="['cwrap','ccall']"  -s WASM=1
