Arduino sketch for analyzing weather data and relaying them over the serial line.

Supported devices:
- Vaisala DRD11A (pinout 4 = digital rain, A0 = analog rain, 5 = analog rain as frequency)
- BME280 (SCL/SDA)
- OneWire temperature sensor (pin 12)

Required pinout:
- Pin 4: DRD11A digital rain
- Pin 5: DRD11A rain frequency (1..3kHz)
- Pin A0: DRD11A analog rain (1..3V)
- Pin A4/A5: BME280 (SDA/SCL)
- Pin 12: OneWire temperature sensor

The sketch will send the latest data over the serial line every couple of seconds or so. The data is formatted according to [NMEA 0183](http://www.hhhh.org/wiml/proj/nmeaxor.html).

$RAIN=1,FREQ=1500,INTENSITY=500,INTERNALTEMP=18.35,ROOMTEMP=15.29,ROOMHUMIDITY=65,ROOMPRESSURE=985*55
