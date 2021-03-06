#ifndef _WASM_MY_CLASS_INCLUDED_
#define _WASM_MY_CLASS_INCLUDED_

class Base {
public:
    Base();
    virtual ~Base();
};

class MyClassIF : public Base {
public:
    virtual int Multiply(int a, int b) = 0;
};

class MyClassImpl : public MyClassIF {
public:
    MyClassImpl();
    virtual ~MyClassImpl() override;
    virtual int Multiply(int a, int b) override;
};

#endif
