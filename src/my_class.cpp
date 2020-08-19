
#include <stdio.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "my_class.hpp"

Base::Base() {
    printf("calling: Base::Base()\n");
}

Base::~Base() {
    printf("calling: Base::~Base()\n");
}

MyClassImpl::MyClassImpl() {
    printf("calling: MyClassImpl::MyClassImpl()\n");
}

MyClassImpl::~MyClassImpl() {
    printf("calling: MyClassImpl::~MyClassImpl()\n");
}

int MyClassImpl::Multiply(int a, int b) {
    printf("calling: MyClassImpl::Multiply()\n");
    return a * b;
}
