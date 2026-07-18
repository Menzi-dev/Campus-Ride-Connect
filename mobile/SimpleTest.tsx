import React from 'react';
import { View, Text } from 'react-native';

export default function SimpleTest() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a1a' }}>
            <Text style={{ color: '#4CAF50', fontSize: 24, fontWeight: 'bold' }}>
                🔗 Backend Connection Test
            </Text>
            <Text style={{ color: '#888', marginTop: 20 }}>
                Status: Not tested
            </Text>
        </View>
    );
}
