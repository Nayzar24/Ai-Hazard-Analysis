import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from safety_assistant import ai_hazard_analysis, update_session_process_data
from flask import request, jsonify

def handler(request):
    if request.method != 'POST':
        return jsonify({'error': 'Method not allowed'}), 405
    
    data = request.get_json()
    try:
        unit = data['unit']
        temp = float(data['temp'])
        pressure = float(data['pressure'])
        chemicals = [c.strip() for c in data['chemicals']]
        
        # Extract new optional fields
        flow_rate = data.get('flowRate')
        operation_phase = data.get('operationPhase')
        equipment_volume = data.get('equipmentVolume')
        phase = data.get('phase')
        location = data.get('location')
        utilities = data.get('utilities', [])
        
        report = ai_hazard_analysis(
            unit, temp, pressure, chemicals, 
            flow_rate, operation_phase, equipment_volume, 
            phase, location, utilities
        )
        
        # Update chat session with process data for context
        session_id = data.get('sessionId', 'default')
        process_data = f"""
        Unit: {unit}
        Temperature: {temp} K
        Pressure: {pressure} atm
        Chemicals: {', '.join(chemicals)}
        {f"Flow Rate: {flow_rate}" if flow_rate else ""}
        {f"Operation Phase: {operation_phase}" if operation_phase else ""}
        {f"Equipment Volume: {equipment_volume}" if equipment_volume else ""}
        {f"Phase: {phase}" if phase else ""}
        {f"Location: {location}" if location else ""}
        {f"Utilities: {', '.join(utilities)}" if utilities else ""}
        """
        update_session_process_data(session_id, process_data)
        
        return jsonify({'report': report})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
