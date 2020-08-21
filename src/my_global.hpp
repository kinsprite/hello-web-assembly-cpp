
#ifndef _WASM_MY_GLOBAL_INCLUDED_
#define _WASM_MY_GLOBAL_INCLUDED_

#include <stdio.h>

class MyGlobal {
    int value;

public:
    MyGlobal() {
        value = 123;
        printf("MyGlobal::MyGlobal()\n");
    }

    ~MyGlobal() {
        printf("MyGlobal::MyGlobal()\n");
    }

    int getValue() const  {
        return value;
    }
};

#endif
