program Hello;
uses
	Mat4, MemoryBuffer, GLUtils, GLTypes,
	BrowserConsole, Web, WebGL, WebGL2, JS, Math;

type
	GLVertex2 = record
		pos: TVec2;
		color: TRGBAb;
	end;

const
	kSIZEOF_VERTEX = 12;

function GetVertexData: TJSUInt8Array;
var
	buffer: TMemoryBuffer;
	verts: TJSArray;
	v: GLVertex2;
	i: integer;
begin
	verts := TJSArray.new;

	v.pos := V2(0, 0);
	v.color := RGBAb(255, 0, 0, 255);
	verts.push(v);

	v.pos := V2(0, 100);
	v.color := RGBAb(0, 255, 0, 255);
	verts.push(v);

	v.pos := V2(100, 100);
	v.color := RGBAb(0, 0, 255, 255);
	verts.push(v);

	// pack the array of verticies into a byte buffer
	buffer := TMemoryBuffer.Create(kSIZEOF_VERTEX * verts.length);
	for i := 0 to verts.length - 1 do
		begin
			v := GLVertex2(verts[i]);
			buffer.AddFloats(2, v.pos);
			buffer.AddBytes(4, v.color);
		end;

	result := buffer.GetBytes;
end;


var
	nextTime: single = 0;
	deltaTime: single = 0;

var
	gl: TJSWebGLRenderingContext;
	shader: TShader;
  projTransform: TMat4;
  viewTransform: TMat4;
  modelTransform: TMat4;

var
	rotateAngle: double = 0;

procedure UpdateCanvas(time: TDOMHighResTimeStamp);
var
	now: single;
	list: TScalarArray;
begin
	now := time * 0.001;
	deltaTime := now - nextTime;
	nextTime := now;

	modelTransform := TMat4.Identity;
	modelTransform := modelTransform.Multiply(TMat4.Translate(100, 100, 0));
	modelTransform := modelTransform.Multiply(TMat4.RotateZ(DegToRad(rotateAngle)));

	//fullTransform := projTransform.Multiply(viewTransform);
	//fullTransform := fullTransform.Multiply(modelTransform);

	rotateAngle := rotateAngle + (20 * deltaTime);

	list := modelTransform.CopyList;
	shader.SetUniformMat4('modelTransform', TJSFloat32List(list));

	//writeln(deltaTime);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	window.requestAnimationFrame(@UpdateCanvas);
end;

var
  canvas: TJSHTMLCanvasElement;
  i: integer;
  offset: integer;
  stride: integer;
  vertexShaderSource: string;
  fragmentShaderSource: string;
  buffer: TJSWebGLBuffer;
  list: TScalarArray;
begin

	// make webgl context
  canvas := TJSHTMLCanvasElement(document.createElement('canvas'));
  canvas.width := 300;
  canvas.height := 300;
	document.body.appendChild(canvas);

	gl := TJSWebGLRenderingContext(canvas.getContext('webgl'));
	if gl = nil then
		begin
			writeln('failed to load webgl!');
			exit;
		end;

	// create shaders from source in html
	vertexShaderSource := document.getElementById('vertex.glsl').textContent;
	fragmentShaderSource := document.getElementById('fragment.glsl').textContent;

	shader := TShader.Create(gl, vertexShaderSource, fragmentShaderSource);
	shader.Compile;
  shader.BindAttribLocation(0, 'in_position');
  shader.BindAttribLocation(1, 'in_color');
	shader.Link;
	shader.Use;

	// prepare context
	gl.clearColor(0.9, 0.9, 0.9, 1);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// setup transform matricies
	projTransform := TMat4.Ortho(0, gl.canvas.width, gl.canvas.height, 0, -1, 1);
	viewTransform := TMat4.Identity;
	modelTransform := TMat4.Identity;

	// TODO: parser bug typecasting to TJSFloat32List(projTransform.CopyList)
	// so we need to assign to a variable first
	list := projTransform.CopyList;
	shader.SetUniformMat4('projTransform', TJSFloat32List(list));
	list := viewTransform.CopyList;
	shader.SetUniformMat4('viewTransform', TJSFloat32List(list));
	list := modelTransform.CopyList;
	shader.SetUniformMat4('modelTransform', TJSFloat32List(list));

	// create buffer
	buffer := gl.createBuffer;
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, GetVertexData, gl.STATIC_DRAW);

	// TODO: vertex array objects were added in webgl2
	offset := 0;  
	stride := kSIZEOF_VERTEX;

	// position
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, offset);
	offset := offset + TVec2_Sizeof;

	// color (normalized = true since we're using unsigned byte)
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, stride, offset);
	offset := offset + TRGBAb_Sizeof;

	//gl.drawArrays(gl.TRIANGLES, 0, 3);

	// fire off the timer to draw
	window.requestAnimationFrame(@UpdateCanvas);
end.