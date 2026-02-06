import { DBCDatabase } from '../types.ts';

/**
 * MASTER DBC DATABASE - OSM PCAN MASTER V8.4 FULL
 * Strictly mapped to provided DBC source text.
 * Endianness: Intel (@1) = isLittleEndian: true, Motorola (@0) = isLittleEndian: false
 */
export const MY_CUSTOM_DBC: DBCDatabase = {
  "2419654480": { // 0x1038FF50
    name: "LV_ID_0x1038FF50_BattError",
    dlc: 8,
    signals: {
      "Battery_Fault": { name: "Battery_Fault", startBit: 0, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Batt_High_Temp": { name: "Batt_High_Temp", startBit: 1, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_High_Temp_Cut_off": { name: "Battery_High_Temp_Cut_off", startBit: 2, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Temp": { name: "Battery_Low_Temp", startBit: 3, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Temp_Cut_off": { name: "Battery_Low_Temp_Cut_off", startBit: 4, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Over_Voltage_Cut_Off": { name: "Battery_Over_Voltage_Cut_Off", startBit: 5, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Over_Voltage": { name: "Battery_Over_Voltage", startBit: 6, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Voltage": { name: "Battery_Low_Voltage", startBit: 7, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Voltage_Cut_Off": { name: "Battery_Low_Voltage_Cut_Off", startBit: 8, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Output_Voltage_Failure": { name: "Output_Voltage_Failure", startBit: 9, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Internal_Fault": { name: "Battery_Internal_Fault", startBit: 10, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "TCU_Communication_Failure": { name: "TCU_Communication_Failure", startBit: 19, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Thermal_Runway": { name: "Battery_Thermal_Runway", startBit: 29, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Peak_Current_Warning": { name: "Peak_Current_Warning", startBit: 26, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2418544720": { // 0x10281050
    name: "LV_ID_0x10281050_Batt_Live_Statu",
    dlc: 8,
    signals: {
      "SOC": { name: "State_of_Charger_SOC", startBit: 0, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "DTE": { name: "Distance_To_Empty_DTE", startBit: 8, length: 8, isLittleEndian: true, isSigned: false, scale: 4, offset: 0, min: 0, max: 1000, unit: "km" },
      "TTC": { name: "Time_To_Charge", startBit: 16, length: 8, isLittleEndian: true, isSigned: false, scale: 3, offset: 0, min: 0, max: 765, unit: "Minute" },
      "Temp": { name: "Battery_Temperature", startBit: 24, length: 8, isLittleEndian: true, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: "C" },
      "Total_kWh": { name: "Total_Battery_Capacity_kWh", startBit: 56, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 250, unit: "kWh" },
      "Total_Ah": { name: "Total_Battery_Capacity_Ah", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 510, unit: "Ah" },
      "DOD": { name: "Battery_DOD", startBit: 40, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "Swap": { name: "Battery_Swap_Sucessfully", startBit: 38, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2485338192": { // 0x14234050
    name: "LV_ID_0x14234050_Drive_Limit",
    dlc: 8,
    signals: {
      "Current": { name: "Battery_Drive_Current_Live", startBit: 0, length: 16, isLittleEndian: true, isSigned: true, scale: 0.1, offset: 0, min: -3000, max: 3000, unit: "Amp" },
      "Limit": { name: "Battery_Drive_Current_Limit", startBit: 16, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 250, unit: "Amp" },
      "Regen": { name: "Battery_Regen_Current_Limit", startBit: 24, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "Amp" },
      "Mode": { name: "Battery_Vehicle_Mode", startBit: 32, length: 3, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 7, unit: "" }
    }
  },
  "2486108048": { // 0x142EFF90
    name: "LV_ID_0x142EFF90_Batt_Live_Info",
    dlc: 8,
    signals: {
      "Current": { name: "Battery_Live_Current", startBit: 0, length: 16, isLittleEndian: true, isSigned: true, scale: 0.1, offset: 0, min: 0, max: 3200, unit: "Amp" },
      "Ah": { name: "Battery_Capacity_Left_Ah", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 320, unit: "Ah" },
      "kWh": { name: "Battery_Capacity_Left_kWh", startBit: 32, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 327, unit: "kWh" },
      "Volt": { name: "Battery_Live_Voltage", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 654, unit: "V" }
    }
  },
  "2460002948": { // 0x12A0AA84 - CHG ERROR
    name: "LV_ID_0x12A0AA84_CHG_ERROR",
    dlc: 8,
    signals: {
      "Temp": { name: "ChargerTemperature", startBit: 7, length: 8, isLittleEndian: false, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: "C" },
      "OV": { name: "ChargerOutputOverVoltage", startBit: 8, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "OC": { name: "ChargerOutputOverCurrent", startBit: 9, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "HW": { name: "ChargerHardwareFailure", startBit: 15, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460002944": { // 0x12A0AA80
    name: "LV_ID_0x12A0AA80_CHG_INFO_HSK",
    dlc: 8,
    signals: {
      "Hand_Shaking": { name: "Charger_Batt_Hand_Shaking", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 127, unit: "" },
      "MaxVoltage": { name: "ChargerMaxVoltageCapability", startBit: 15, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 818, unit: "V" },
      "MaxCurrent": { name: "ChargerMaxCurrentCapability", startBit: 31, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 400, unit: "A" },
      "EmergencyShutdown": { name: "ChargerEmergencyShutdown", startBit: 40, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460002945": { // 0x12A0AA81 - CHG LIVE
    name: "LV_ID_0x12A0AA81_CHG_LIVE",
    dlc: 8,
    signals: {
      "Volt": { name: "ChargerChargingVoltageLive", startBit: 7, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 1300, unit: "V" },
      "Curr": { name: "ChargerChargingCurrentLive", startBit: 23, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 160, unit: "A" },
      "ChargingMode": { name: "ChargerChargingModeStatus", startBit: 33, length: 2, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 3, unit: "" }
    }
  },
  "2460057770": { // 0x12A180AA
    name: "LV_ID_0x12A180AA_BMS_MAX_LIMITS_HSK",
    dlc: 8,
    signals: {
      "Hand_Shaking": { name: "Batt_Charger_Hand_Shaking", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Current_MAXLIMIT": { name: "Charging_Current_MAXLIMIT", startBit: 31, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 163, unit: "A" },
      "Voltage_MAXLIMIT": { name: "Charging_Voltage_MAXLIMIT", startBit: 15, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 1310, unit: "V" },
      "Emergency_Shutdown": { name: "Emergency_Shutdown", startBit: 40, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460057771": { // 0x12A180AB
    name: "LV_ID_0x12A180AB_BMS_LIVE_REQ",
    dlc: 8,
    signals: {
      "RequestVoltage": { name: "ChargingRequestVoltage", startBit: 23, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6553, unit: "V" },
      "RequestCurrent": { name: "ChargingRequestCurrent", startBit: 7, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 655, unit: "A" },
      "On_Off": { name: "Charging_On_Off", startBit: 34, length: 2, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 2, unit: "" },
      "Activation": { name: "Charging_Activation", startBit: 32, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2552647744": { // 0x18265040
    name: "LV_ID_0x18265040_MCU_Motor_Temp",
    dlc: 8,
    signals: {
      "Ctrl_Temp": { name: "MCU_Controller_Temperature", startBit: 0, length: 8, isLittleEndian: true, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: "C" },
      "Mot_Temp": { name: "MCU_Motor_Temperature", startBit: 8, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: -50, min: -50, max: 205, unit: "C" },
      "Speed": { name: "sigSpeed", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "kmph" },
      "Throttle": { name: "sigThrottle", startBit: 32, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" }
    }
  },
  "2552713280": { // 0x18275040
    name: "LV_ID_0x18275040_MCU_Status",
    dlc: 8,
    signals: {
      "RPM": { name: "MCU_Motor_RPM", startBit: 0, length: 16, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 65535, unit: "RPM" },
      "Pre_V": { name: "MCU_Capacitor_Voltage_Pre", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6000, unit: "V" },
      "Post_V": { name: "MCU_Capacitor_Voltage_Post", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6000, unit: "V" }
    }
  },
  "2437982721": { // 0x1150AA01
    name: "LV_ID_0x1150AA01_TPMS",
    dlc: 8,
    signals: {
      "P1": { name: "TPMS_Tire_Pressure_1", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P2": { name: "TPMS_Tire_Pressure_2", startBit: 15, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P3": { name: "TPMS_Tire_Pressure_3", startBit: 23, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P4": { name: "TPMS_Tire_Pressure_4", startBit: 31, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" }
    }
  },
  "2471537153": { 
    name: "LV_ID_0x1350AA01_Cell_1_4_Volt", 
    dlc: 8, 
    signals: { 
      "C1": { name: "Battery_Cell_Volt_1", startBit: 0, length: 16, isLittleEndian: true, isSigned: false, scale: 0.0001, offset: 0, min: 0, max: 6, unit: "V" }, 
      "C2": { name: "Battery_Cell_Volt_2", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.0001, offset: 0, min: 0, max: 6, unit: "V" }, 
      "C3": { name: "Battery_Cell_Volt_3", startBit: 32, length: 16, isLittleEndian: true, isSigned: false, scale: 0.0001, offset: 0, min: 0, max: 6, unit: "V" }, 
      "C4": { name: "Battery_Cell_Volt_4", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.0001, offset: 0, min: 0, max: 6, unit: "V" } 
    } 
  }
};

export const DEFAULT_LIBRARY_NAME = "OSM_PCAN_MASTER_FULL_V8.4";
