/*
 * Copyright (c) 2016 Jari Saukkonen
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
#ifndef NMEASERIAL_H
#define NMEASERIAL_H

#include <Arduino.h>

class NMEASerial {
public:
    enum State {
        STATE_WAITING_START,
        STATE_IN_MESSAGE,
        STATE_CHECKSUM_1,
        STATE_CHECKSUM_2
    };

    class ISerialHandler {
    public:
        virtual void onMessage(String message) = 0;
    };

    NMEASerial(ISerialHandler* handler);

    void onSerialEvent();
    void print(const String& str);

private:
    bool checksumValid(const String& buffer, const char* checksumToTest);
    char checksum(const String& buffer);

private:
    static const int BUFFER_SIZE = 100;

    State m_state;
    String m_buffer;
    char m_checksum[2];
    ISerialHandler* m_serialHandler;
};

#endif
