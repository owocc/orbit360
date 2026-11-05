import 'package:flutter_test/flutter_test.dart';
import 'package:orbit360_app/main.dart';

void main() {
  testWidgets('OrbitApp smoke test renders stage and controls', (WidgetTester tester) async {
    await tester.pumpWidget(const OrbitApp());
    await tester.pump();

    // Verify main components render
    expect(find.text('环绕视角'), findsOneWidget);
    expect(find.text('陀螺仪'), findsWidgets);
    expect(find.text('重置'), findsOneWidget);
    expect(find.text('反向'), findsOneWidget);
    expect(find.text('惯性'), findsOneWidget);
  });
}
