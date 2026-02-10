
import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Info, Cpu, Cable, Bluetooth, Zap, ChevronRight } from 'lucide-react';

interface ESP32SetupGuideProps {
  onClose: () => void;
  baudRate: number;
}

const ESP32SetupGuide: React.FC<ESP32SetupGuideProps> = ({ onClose, baudRate }) => {
  const [copied, setCopied] = useState(false);
  const [firmwareType, setFirmwareType] = useState<'hybrid' | 'serial' | 'ble'>('hybrid');

  const hybridFirmware = useMemo(() => {
    return `/* 
 * OSM UNIFIED CAN BRIDGE v12.1
 * Fixed: BLE Packet Termination
 */
#include <Arduino.h>
#include "driver/twai.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define TX_CHARACTERISTIC_UUID "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { 
      deviceConnected = true; 
      Serial.println("BLE: CLIENT_CONNECTED");
    };
    void onDisconnect(BLEServer* pServer) { 
        deviceConnected = false; 
        Serial.println("BLE: CLIENT_DISCONNECTED");
        pServer->getAdvertising()->start(); 
    }
};

void setup() {
  Serial.begin(${baudRate});
  delay(1000);

  BLEDevice::init("OSM_CAN_BT");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(
      TX_CHARACTERISTIC_UUID, 
      BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  pServer->getAdvertising()->start();

  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  twai_driver_install(&g_config, &t_config, &f_config);
  twai_start();
  Serial.println("SYS: BRIDGE_ACTIVE_500K");
}

void loop() {
  twai_message_t msg;
  if (twai_receive(&msg, pdMS_TO_TICKS(1)) == ESP_OK) {
    if (!(msg.rtr)) {
      String packet = String(msg.identifier, HEX) + "#" + String(msg.data_length_code) + "#";
      for (int i = 0; i < msg.data_length_code; i++) {
        if (msg.data[i] < 0x10) packet += "0";
        packet += String(msg.data[i], HEX);
        if (i < msg.data_length_code - 1) packet += ",";
      }

      Serial.println(packet);

      if (deviceConnected) {
        // FIXED: Using single \n for proper JS splitting
        String blePacket = packet + "\n";
        pTxCharacteristic->setValue(blePacket.c_str());
        pTxCharacteristic->notify();
      }
    }
  }
}`;
  }, [baudRate]);

  const serialFirmware = useMemo(() => {
    return `#include <Arduino.h>
#include "driver/twai.h"

#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

void setup() {
  Serial.begin(${baudRate});
  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  twai_driver_install(&g_config, &t_config, &f_config);
  twai_start();
}

void loop() {
  twai_message_t msg;
  if (twai_receive(&msg, pdMS_TO_TICKS(1)) == ESP_OK) {
    if (!(msg.rtr)) {
      Serial.print(msg.identifier, HEX);
      Serial.print("#");
      Serial.print(msg.data_length_code);
      Serial.print("#");
      for (int i = 0; i < msg.data_length_code; i++) {
        if (msg.data[i] < 0x10) Serial.print("0");
        Serial.print(msg.data[i], HEX);
        if (i < msg.data_length_code - 1) Serial.print(",");
      }
      Serial.println();
    }
  }
}`;
  }, [baudRate]);

  const currentCode = firmwareType === 'hybrid' ? hybridFirmware : serialFirmware;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg font-orbitron font-black text-slate-900 uppercase tracking-tight">Flash_Firmware</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ESP32 Tactical Bridge</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => setFirmwareType('hybrid')}
              className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${
                firmwareType === 'hybrid' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <div className="flex gap-2">
                <Cable size={20} />
                <Bluetooth size={20} />
              </div>
              <span className="text-[9px] font-orbitron font-black uppercase">Hybrid_Unified (Recommended)</span>
            </button>
            <button 
              onClick={() => setFirmwareType('serial')}
              className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${
                firmwareType === 'serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <Cable size={20} />
              <span className="text-[9px] font-orbitron font-black uppercase">Serial_Only (Lightweight)</span>
            </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl mb-8 flex items-start gap-4">
             <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
               <Info size={24} />
             </div>
             <div>
               <h4 className="text-[11px] font-orbitron font-black text-emerald-900 uppercase tracking-widest mb-1">Deployment Guide</h4>
               <p className="text-[10px] text-emerald-700 leading-relaxed">
                 The <b>Hybrid Mode</b> enables both interfaces. Use 500kbps CAN speed. Ensure location services are ON on your phone during pairing.
               </p>
             </div>
          </div>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-orbitron font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                Arduino_Source_IDE
              </h3>
              <button onClick={handleCopy} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy_to_Clipboard'}
              </button>
            </div>
            <div className="relative">
                <pre className="p-6 bg-slate-900 rounded-3xl font-mono text-[11px] text-emerald-500/90 overflow-x-auto shadow-2xl h-[450px] custom-scrollbar border border-slate-800">
                {currentCode}
                </pre>
            </div>
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
          <button onClick={onClose} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-orbitron font-black uppercase tracking-widest shadow-xl transition-all hover:bg-indigo-700 active:scale-95 flex items-center gap-3">
            Proceed_to_HUD <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ESP32SetupGuide;
