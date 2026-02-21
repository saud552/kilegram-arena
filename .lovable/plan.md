

## خطة إصلاح النماذج ثلاثية الأبعاد في المتجر

### السبب الجذري
ملفات GLB تُحمَّل بنجاح لكنها تتعطل أثناء العرض (Rendering) بسبب خطأ:
```
Cannot read properties of null (reading 'trim')
```
هذا الخطأ يحدث في WebGLProgram عند محاولة تجميع shaders لمواد (materials) غير متوافقة مع Three.js 0.160. عندما يحدث الخطأ، يُفعَّل Error Boundary ويعرض النموذج البديل (FallbackModel) وهو الشكل الهندسي البسيط (المربعات والكبسولات) الذي يشبه ماينكرافت.

بالإضافة لذلك، نماذج التجهيزات (الخوذات والحقائب) في `GearModel3D.tsx` مبنية بالكامل من أشكال هندسية بدائية (boxGeometry) وليس لها ملفات GLB.

### الحل

#### 1. إصلاح تحميل المواد في CharacterModel3D و WeaponModel3D
- عند استنساخ المشهد (scene.clone)، استبدال كل مادة (material) بنسخة جديدة من `MeshStandardMaterial` مع نقل الخصائص الأساسية (color, map, normalMap, roughness, metalness)
- هذا يضمن عدم وجود shaders مخصصة أو null تسبب الخطأ
- إضافة `material.side = THREE.DoubleSide` لجميع المواد

#### 2. تحسين نماذج التجهيزات (GearModel3D)
- التجهيزات (خوذات وحقائب) ليس لها ملفات GLB متاحة
- تحسين الأشكال الهندسية باستخدام `sphereGeometry` و `cylinderGeometry` بدلاً من `boxGeometry` فقط لتبدو أكثر واقعية وأقل شبهاً بماينكرافت

#### 3. تحسين معالجة الأخطاء
- إضافة `onError` callback لـ `useGLTF` لالتقاط أخطاء التحميل
- تسجيل الأخطاء في console لتسهيل التشخيص

### التفاصيل التقنية

**الملفات المتأثرة:**
- `src/components/models/CharacterModel3D.tsx` — استبدال المواد بـ MeshStandardMaterial آمنة
- `src/components/models/WeaponModel3D.tsx` — نفس الإصلاح
- `src/components/models/GearModel3D.tsx` — تحسين الأشكال الهندسية لتكون أكثر واقعية

**جوهر الإصلاح:**
```typescript
// بدلاً من مجرد تعديل المادة الأصلية:
child.material.side = THREE.DoubleSide;

// نستبدلها بمادة جديدة آمنة:
const oldMat = child.material;
child.material = new THREE.MeshStandardMaterial({
  color: oldMat.color || new THREE.Color(0x888888),
  map: oldMat.map || null,
  normalMap: oldMat.normalMap || null,
  roughness: oldMat.roughness ?? 0.5,
  metalness: oldMat.metalness ?? 0.3,
  side: THREE.DoubleSide,
});
```

