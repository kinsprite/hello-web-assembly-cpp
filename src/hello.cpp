
#include <iostream>
#include <memory>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "hello.hpp"
#include "my_global.hpp"
#include "my_class.hpp"

MyGlobal myGlobal;

int main(int argc, char const *argv[])
{
    // std::cout << "Hello World!" << std::endl;
    printf("Hello World!\n");
    return 0;
}

void testCall()
{
    printf("function was called!\n");
}

void printNumber(int f) {
    printf("Printing the number %d\n", f);
}

int square(int c)
{
    return c*c;
}

int multiply(int a, int b) {
    std::unique_ptr<MyClassIF> ptr = std::make_unique<MyClassImpl>();
    return ptr->Multiply(a, b);
}

int getGlobalValue() {
    return myGlobal.getValue();
}
