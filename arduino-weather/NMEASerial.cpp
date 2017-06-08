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
 #include "NMEASerial.h"

NMEASerial::NMEASerial(ISerialHandler* handler) :
    m_serialHandler(handler) {
}

void NMEASerial::onSerialEvent() {
    while (Serial.available()) {
        char input = (char)Serial.read();

        switch (m_state) {
        case STATE_WAITING_START:
            if (input == '$') {
                m_state = STATE_IN_MESSAGE;
                m_buffer = "";
                m_buffer.reserve(BUFFER_SIZE);
            }
        break;
        case STATE_IN_MESSAGE:
            if (input == '*') {
                m_state = STATE_CHECKSUM_1;
                break;
            }
            if (m_buffer.length() >= BUFFER_SIZE) {
                m_state = STATE_WAITING_START;
                m_buffer = "";
                m_buffer.reserve(BUFFER_SIZE);
            }
            m_buffer += input;
            break;
        case STATE_CHECKSUM_1:
            m_state = STATE_CHECKSUM_2;
            m_checksum[0] = input;
            break;
        case STATE_CHECKSUM_2:
            m_state = STATE_WAITING_START;
            m_checksum[1] = input;
            if (checksumValid(m_buffer, m_checksum))
                m_serialHandler->onMessage(m_buffer);
            m_buffer = "";
            m_buffer.reserve(BUFFER_SIZE);
            break;
        }
    }
}

bool NMEASerial::checksumValid(const String& buffer, const char* checksumToTest) {
    char sum = checksum(buffer);
    char chars[17] = "0123456789ABCDEF";
    return (checksumToTest[0] == chars[(sum >> 4) & 0x0F]) && (checksumToTest[1] == chars[sum & 0x0F]);
}

char NMEASerial::checksum(const String& buffer) {
    char sum = 0;
    for (int i = 0; i < buffer.length(); i++)
        sum ^= buffer[i];
    return sum;
}

void NMEASerial::print(const String& str) {
    Serial.print('$');
    Serial.print(str);
    Serial.print('*');
    int sum = checksum(str);
    if (sum < 10)
        Serial.print('0');
    Serial.print(checksum(str), HEX);
    Serial.println();
}
