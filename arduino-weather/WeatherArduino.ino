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
static bool hasInteriorSensor = false;
static bool hasEnclosureSensor = false;
static Adafruit_BME280 bme;
static OneWire onewire(PIN_ONEWIRE);
static DallasTemperature dallasTemperature(&onewire);
static NMEASerial nmeaSerial(NULL);

static bool lastRainState = false;
static unsigned long lastReportTime = 0;

void setup() {
    pinMode(PIN_DRD11A_RAIN, INPUT);
    pinMode(PIN_DRD11A_INTENSITY, INPUT);

    Serial.begin(57600);
    FreqCount.begin(1000);

    hasInteriorSensor = bme.begin();
    dallasTemperature.begin();
    hasEnclosureSensor = (dallasTemperature.getDeviceCount() > 0);
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

    if (hasEnclosureSensor) {
        dallasTemperature.requestTemperatures();
        float enclosureTemp = dallasTemperature.getTempCByIndex(0);
        msg += ",ENCLOSURETEMP=";
        msg += enclosureTemp;
    }
    if (hasInteriorSensor) {
        float interiorTemp = bme.readTemperature();
        float interiorHumidity = bme.readHumidity();
        float interiorPressure = bme.readPressure();
        msg += ",INTERIORTEMP=";
        msg += interiorTemp;
        msg += ",INTERIORHUMIDITY=";
        msg += interiorHumidity;
        msg += ",INTERIORPRESSURE=";
        msg += interiorPressure;
    }

    unsigned long currentTime = millis();
    unsigned long timeSinceLastReport = currentTime - lastReportTime;
    if ((lastRainState == false && rain) || timeSinceLastReport > 10000) {
        lastReportTime = currentTime;
        nmeaSerial.print(msg);
    }
    lastRainState = rain;
}
