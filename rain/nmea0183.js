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

(function() {

    var State = {
        WAITING_START: 0,
        IN_MESSAGE: 1,
        CHECKSUM_1: 2,
        CHECKSUM_2: 3
    };

    var checksumValid = function(input, checksum) {
        var sum = 0;
        for (var i = 0; i < input.length; i++) {
            sum = sum ^ input.charCodeAt(i);
        }
        var calculatedChecksum = sum.toString(16).toUpperCase();
        checksum = checksum.toUpperCase();
        if (sum < 10)
            calculatedChecksum = '0' + calculatedChecksum;
        return checksum == calculatedChecksum;
    };

    var Parser = function() {
        this.state = State.WAITING_START;
        this.buffer = "";
        this.checksum = "";

        this.consume = function(input) {
            switch (this.state) {
            case State.WAITING_START:
                if (input == '$') {
                    this.state = State.IN_MESSAGE;
                    this.buffer = "";
                }
                return { complete:false };
            case State.IN_MESSAGE:
                if (input == '*') {
                    this.state = State.CHECKSUM_1;
                    return { complete:false };
                }
                if (this.buffer.length >= 200) {
                    this.state = State.WAITING_START;
                    this.buffer = "";
                }
                this.buffer += input;
                return { complete:false };
            case State.CHECKSUM_1:
                this.state = State.CHECKSUM_2;
                this.checksum = input;
                return { complete:false };
            case State.CHECKSUM_2:
                this.state = State.WAITING_START;
                this.checksum += input;
                var result = checksumValid(this.buffer, this.checksum) ? this.buffer : "";
                this.buffer = "";
                this.checksum = "";
                return { complete:true, success:(result.length > 0), message:result };
            }
        }
        return this;
    };

    module.exports = Parser;
})();
