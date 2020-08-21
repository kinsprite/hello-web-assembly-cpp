#ifndef _WASM_HELLO_INCLUDED_
#define _WASM_HELLO_INCLUDED_

#ifdef __cplusplus
extern "C" {
#endif

    int main(int argc, char const *argv[]);
    void testCall();
    void printNumber(int f);
    int square(int c);
    int multiply(int a, int b);
    int getGlobalValue();

#ifdef __cplusplus
}
#endif

#endif
