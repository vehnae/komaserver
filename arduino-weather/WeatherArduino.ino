#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <DallasTemperature.h>
#include <FreqCount.h>
#include <OneWire.h>

#include "NMEASerial.h"

#define PIN_DRD11A_RAIN 4
#define PIN_DRD11A_INTENSITY A0
#define PIN_DRD11A_FREQ 5
#define PIN_ONEWIRE 12
// SCL A5
// SDA A4

static int rainFrequency = 0;
static bool hasRoomSensor = false;
static bool hasInternalSensor = false;
static Adafruit_BME280 bme;
static OneWire onewire(PIN_ONEWIRE);
static DallasTemperature dallasTemperature(&onewire);
static NMEASerial nmeaSerial(NULL);

void setup() {
    pinMode(PIN_DRD11A_RAIN, INPUT);
    pinMode(PIN_DRD11A_INTENSITY, INPUT);

    Serial.begin(57600);
    FreqCount.begin(1000);

    hasRoomSensor = bme.begin();
    dallasTemperature.begin();
    hasInternalSensor = (dallasTemperature.getDeviceCount() > 0);
}

void loop() {
    if (FreqCount.available()) {
        rainFrequency = FreqCount.read();
    }
    bool rain = (digitalRead(PIN_DRD11A_RAIN) == LOW);
    int rainIntensity = analogRead(PIN_DRD11A_INTENSITY);

    String msg = "RAIN=";
    msg += rain ? 1 : 0;
    msg += ",FREQ=";
    msg += rainFrequency;
    msg += ",INTENSITY=";
    msg += rainIntensity;

    if (hasInternalSensor) {
        dallasTemperature.requestTemperatures();
        float internalTemp = dallasTemperature.getTempCByIndex(0);
        msg += ",INTERNALTEMP=";
        msg += internalTemp;
    }
    if (hasRoomSensor) {
        float roomTemp = bme.readTemperature();
        float roomHumidity = bme.readHumidity();
        float roomPressure = bme.readPressure();
        msg += ",ROOMTEMP=";
        msg += roomTemp;
        msg += ",ROOMHUMIDITY=";
        msg += roomHumidity;
        msg += ",ROOMPRESSURE=";
        msg += roomPressure;
    }
    nmeaSerial.print(msg);

    delay(1000);
}
