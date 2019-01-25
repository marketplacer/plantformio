#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include "env.h"
extern "C" {
  #include "libb64/cdecode.h"
}

WiFiClientSecure wiFiClient;
PubSubClient pubSubClient(MQTT_SERVER, 8883, wiFiClient);

void connectWiFi () {
  Serial.print("Connecting to "); Serial.print(SSID);
  WiFi.begin(SSID, WIFI_PASS);
  WiFi.waitForConnectResult();
  Serial.print(", WiFi connected, IP address: "); Serial.println(WiFi.localIP());
}

void setupCertificates () {
  uint8_t binaryCert[certificatePemCrt.length() * 3 / 4];
  int len = b64decode(certificatePemCrt, binaryCert);
  wiFiClient.setCertificate(binaryCert, len);

  uint8_t binaryPrivate[privatePemKey.length() * 3 / 4];
  len = b64decode(privatePemKey, binaryPrivate);
  wiFiClient.setPrivateKey(binaryPrivate, len);
}

void setup() {
  delay(250);
  Serial.begin(115200);
  delay(250);

  connectWiFi();
  setupCertificates();
}

unsigned long lastPublish;

void sendReading() {
  int reading = analogRead(A0);
  char readingStr [20];
  sprintf( readingStr, "{\"value\": %i}", reading);
  Serial.print("Publishing: ");
  Serial.println(readingStr);
  pubSubClient.publish(PLANT_TOPIC, readingStr);
  lastPublish = millis();
}

void loop() {
  pubSubCheckConnect();

  if (millis() - lastPublish > 10000) { // 20 minutes
    sendReading();
  }
}

void pubSubCheckConnect() {
  if ( ! pubSubClient.connected()) {
    String clientId = "Sensor-";
    clientId += PLANT_TOPIC;
    Serial.print("Client ID: ");
    Serial.println(clientId);
    Serial.print("PubSubClient connecting to: ");
    Serial.print(MQTT_SERVER);

    while ( ! pubSubClient.connected()) {
      Serial.print(".");
      pubSubClient.connect(clientId.c_str());
      delay(100);
    }

    Serial.println(" connected!");
  }

  pubSubClient.loop();
}

int b64decode(String b64Text, uint8_t* output) {
  base64_decodestate s;
  base64_init_decodestate(&s);
  int cnt = base64_decode_block(b64Text.c_str(), b64Text.length(), (char*)output, &s);
  return cnt;
}
